import {WebSocketServer,WebSocket} from "ws";
import jwt, { JwtPayload } from "jsonwebtoken"
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
const wss=new WebSocketServer({port:8080})
interface User{
    ws:WebSocket,
    rooms:string[],
    userId:string
}
const users:User[]=[]

function checkUser(token:string):string|null{
    try{const  decoded=jwt.verify(token,JWT_SECRET)

    if(typeof decoded=="string"){
        return null;
    }
    if(!decoded||!decoded.userId){
        return null;
    }
    return decoded.userId;
}catch(e){
    return null;
}
}

wss.on('connection', (ws,request)=>{
    const url=request.url;

    if(!url){
        return;
    }
    const queryParams=new  URLSearchParams(url.split('?')[1]);
    const token= queryParams.get('token')|| "" ;
    const userId=checkUser(token);
    if(!userId){
        ws.close()
        return null 
    }
    users.push({
        userId,
        rooms:[],
        ws
    })
    ws.on("message",async (data)=>{
        try{
            const parseData=JSON.parse(data as unknown as string);
            console.log("received:", parseData);
        if(parseData.type==="join_room"){
            const user=users.find(x=>x.ws===ws)
                user?.rooms.push(parseData.roomId)
        }
        if(parseData.type==="leave_room"){
            const user=users.find(x=>x.ws===ws)
            if(!user){
                return;
            }
            user.rooms=user?.rooms.filter(x=>x!==parseData.roomId)
        }

        if(parseData.type==="chat"){
            const roomId=Number(parseData.roomId)
            const message=parseData.message
            await prismaClient.chat.create({
            data:{
                roomId,
                message,
                userId
            }
        })
         users.forEach(user=>{
                if(user.rooms.includes(String(roomId))){
                    user.ws.send(JSON.stringify({
                        type:"chat",
                        message:message,
                        roomId,
                        userId
                    }))
                }
            })
        }
    }catch(e){
        console.error("Error parsing message:", e)
    }
    });
});