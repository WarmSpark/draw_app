import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import { CreateUserSchema,signinSchema,CreateRoomSchema } from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
const app = express();
app.use(express.json())

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

//should hash the password later 
app.post("/signup", async (req, res) => {
  const Parsedata = CreateUserSchema.safeParse(req.body);
  if (!Parsedata.success) {
    res.json({
      message: "incorrect inputs",
    });
    return;
  }
  try{
    const user= await prismaClient.user.create({
    data:{
      email:Parsedata.data?.username,
      password:Parsedata.data?.password,
      name:Parsedata.data?.name
    }
  })
  res.json({
    userId: user.id,
  });
}catch(e){
  res.status(411).json({
    message:"user already exist"
  })
}
});
//check the hashed password later
app.post("/signin", async (req, res) => {
const Parseddata = signinSchema.safeParse(req.body);
  if (!Parseddata.success) {
    res.json({
      message: "incorrect inputs",
    });
    return;
  }
  const user= await prismaClient.user.findFirst({
    where:{
      email:Parseddata.data.username,
      password:Parseddata.data.password
    }
  })
  if(!user){
    res.status(403).json({
      message:"not authorized"
    })
    return;
  }
  const token = jwt.sign(
    {
      userId:user?.id
    },
    JWT_SECRET,
  );

  res.json({
    token,
  });
});
app.post("/room", middleware, async (req, res) => {
  const Parseddata = CreateRoomSchema.safeParse(req.body);
  if (!Parseddata.success) {
    res.json({
      message: "incorrect inputs",
    });
    return;
  }
  const userId=req.userId
  if(!userId){
    res.status(403).json({
      message:"not allowed"
    })
    return
  }
  try{
    const room=await prismaClient.room.create({
    data:{
      Slug:Parseddata.data.name,
      adminId:userId
    }

  })
  res.json({
    roomId: room.id,
  }); 
}catch(e){
  res.status(411).json({
    message:"room already exists"
  })
}
});
app.get("/chats/:roomId",async(req,res)=>{
  const roomId=Number(req.params.roomId);
  const messages=await prismaClient.chat.findMany({
    where:{
      roomId:roomId
    },
    orderBy:{
      id:"desc"
    },
    take:50,
    include:{
      user:{
        select:{ name:true, id:true }
      }
    }
  });
  res.json({
    messages
  })
})

app.get("/rooms", middleware, async (req, res) => {
  const rooms = await prismaClient.room.findMany({
    orderBy: { CreatedAt: "desc" },
    select: { id: true, Slug: true, CreatedAt: true, admin: { select: { name: true } } }
  });
  res.json({ rooms });
});

app.listen(3001);
