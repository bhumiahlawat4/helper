const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const bcrypt = require("bcrypt");

//resetPasswordToken
exports.resetPasswordToken = async(req,res)=>{
   try{
      //get email from req body
      const email = req.body.email;
      //check user for this email, email validation
      const user = await User.findOne({email: email});
      if(!user){
         return res.json({
           success: false,
           message:'Your Email is not registered with us',
         })
      }
      //generate token
      const token = crypto.randomUUID();
      //update user by adding token and expiration time
      const updatedDetails = await User.findOneAndUpdate(
                                        {email:email},
                                        {
                                          token:token,
                                          resetPasswordExpires:Date.now() + 5 * 60 * 1000,
                                        },
                                        {new:true})
      //create url
       //link generate
       const url = `https://localhost:3000/update-password/${token}` //fee ka link bana liya h, token se alag alag link banenge..jaise token ki value differ krti jaayegi,alag alag link bante jaayenge,nahi toh ek he link se pwd thodi change krlega,har user k liye alag link banega

      //send mail containing the url
      await mailSender(email,
                       "Password Reset Link",
                       `Password Reset Link: ${url}`
                      );
      //return response
      return res.json({
        success:true,
        message:"Email sent successfully, please check email and change password",
      });
      //agar mai har user k schema mein jaakr ek token rkhdu 
      //aur uska expiration time rkhdu toh kitna ez hojega token ki aur user ki mapping krna ,har user k pass ek 
      //khud ka token h aur apna khud ka expiration time h, uske adhaar par wo fee mein jaa skta h aur change kr skta h
   }
   catch(error){
      console.log(error);
      return res.status(500).json({
         success:false,
         message:'Something went wrong while sending  reset pwd mail',
      });
   }
}


//resetPassword
exports.resetPassword = async(req, res) =>{
  try{
     //data fetch
     const {password, confirmPassword, token} = req.body; //doubt h ab k jo token h wo toh parameter se utha skta hu na mai, token toh humne parameter mein pass kr rkha h url mein upar . ab kya url se token utha skte ho>yes. par yhn toh hum body se token nikaalre h toh body mein kaise aagya ye.maine kaha req kahan se ayi h?fee ne daala isko i.e. why hum isko body mein se uthaane ki koshish krre h
     //validation
     if(password != confirmPassword){
        return res.json({
           success:false,
           message:'Password is not matching',
        });
     }
     //get user details from db using token
     const userDetails = await User.findOne({token:token}); 
     //jo token tumhe mila h, uska yhn kya usage hoga?jo tumahre pass pwd aaya h ,isko khn par insert karoge ,
     //jo naye waale pwd aate h usko kismein insert krte ho ,user k andar ofc,
     //ab user ki entry nikaalenge kaise?ofc token se user ki entry nikaal lenge.

     //if no token-invalid token
     if(!userDetails){
       return res.json({
          success:false,
          message:'Token is invalid',
       });
     }

     //token time check
     if(userDetails.resetPasswordExpires < Date.now()){
       return res.json({
          success:false,
          message:'Token isexpired, please regenerate your token',
       });
     }
     //hash pwd
     const hashedPassword = await bcrypt.hash(password, 10);
     //password update
     await User.findOneAndUpdate(
        {token:token}, //pwd ko update krne k liye aapne token ko as a search parameter//i.e. why upar waala ka RPTken rkha tha naam taaki mai token generate kr paau aur iss token ko mai user ki entry mein insert kar paau aur baad mein issi token ka use krke ,user k pwd ko mai uppdate kar paau.
        {password:hashedPassword},
        {new:true},
     );
     //return response
     return res.status(200).json({
       success:true,
       message:'Password Reset Successful',
     }); 
    
  }
  catch(error){
     
  }
}