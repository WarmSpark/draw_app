import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import { CreateUserSchema,signinSchema,CreateRoomSchema } from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
const app = express();
app.use(express.json())
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
  const messages=await prismaClient.room.findMany({
    where:{
      id:roomId
    },
    orderBy:{
      id:"desc"
    },
    take:50
  });
  res.json({
    messages
  })
})
app.listen(3001);
