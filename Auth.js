const User = require("../models/User");
const OTP = require("../models/OTP");
const otpGenerator = require("otp-generator");
const bcrypt = require("bcrypt");
const Profile = require('../models/Profile');
const jwt = require("jsonwebtoken");
const mailSender = require("../utils/mailSender");
const { passwordUpdated } = require("../mail/templates/passwordUpdate");
require('dotenv').config();

//sendOTP
exports.sendOTP = async(req, res) =>{
    try{
              //fetch email from req ki body
          const {email} = req.body;
          console.log("Email in senOtp controller",email)

          //check if user already exists
          const existingUser = await User.findOne({email});

          //if user already exists, then returna response
          if(existingUser){
            return res.status(401).json({
              success:false,
              message: "Email already exists"
             })
          }

        //generate otp
        let otp = otpGenerator.generate(6, {
           upperCaseAlphabets:false,
           lowerCaseAlphabets:false,
           specialChars:false,
        });
        console.log("OTP generated: " , otp);

        //check unique otp or not
        //THIS is brute force 
        let result = await OTP.findOne({otp: otp}); //bekar code h ye kyunki hum baar baar db mein check krre h, hume koi aisi lib use krni chahiye jo hume unique he de humesha

        while(result){
           otp = otpGenerator(6, {
            upperCaseAlphabets:false,
            lowerCaseAlphabets:false,
            specialChars:false,
           });
           result = await OTP.findOne({otp: otp});
        }

        // const otpPayload = {email, otp}; //agar mai createdAt nahi daalti toh usmein already by defaultlikha hua h

        // //create an entry for OTP.
        // const otpBody = await OTP.create(otpPayload);
        // console.log(otpBody);

        // //return a response successful
        // res.status(200).json({
        //    success:true,
        //    message:'OTP Sent Successfully',
        //    otp,
        // })
        console.log("OTP generated", otp);

        const createdOtp = await OTP.create({
            email,
            otp
        })

        return res.status(200).json({
            success:true,
            message: "OTP created!",
            createdOtp
        })
    }
    catch(error){
       console.log(error);
       return res.status(500).json({
          success:false,
          message:error.message,
       })
    }
}

//signUp
exports.signUp = async(req, res) =>{
   try{
            //data fetch from req ki body
        const {
          firstName,
          lastName,
          email,
          password,
          confirmPassword,
          accountType,
          otp, contactNumber
      } = req.body;
      //validate krlo
      if(!firstName || !lastName || !email || !password || !confirmPassword || !otp){ //acntType kyu ni kiya? wo toh tabs haina, kisi par b raho, ek value toh milne he waali h
        //contactnumber ko optional rkhdia humne isliye ni kiya add
          return res.status(403).json({
            success:false,
            // message:"All fields are required",
            message: "Fill all details"
          })
      }
      //2 password match krlo
      if(password !==confirmPassword){
        return res.status(403).json({
            success:false,
            // message:'Password and ConfirmPassword Value does not match, please try again',
             message: "Passwords don't match"
        });
      }

      //check user already exist or not
      const existingUser = await User.findOne({email});
      if(existingUser){
          return res.status(400).json({
            success:false,
            // message:'User is already registered',
            message: "Email already exists"
          });
      }
      //find most recent OTP stored for the user
      const recentOtp =await OTP.find({email}).sort({createdAt:-1}).limit(1); //sort aur limit se humne most recent waala nikaal liya
      // console.log(recentOtp);
      console.log("Otp in signup page is:",recentOtp[0].otp)
      //validate OTP
      if(recentOtp.length == 0){
        //OTP not found
        return res.status(400).json({
          success:false,
          message:'OTP Not found',
        })
      // }else if(otp != recentOtp.otp){
      } else if(otp !== recentOtp[0].otp){
          //Invalid OTP
          return res.status(400).json({
            success:false,
            message: 'Invalid Otp',
          })
      }

      //Hash password
      const hashedPwd = await bcrypt.hash(password, 10);

      let approved = "";
		approved === "Instructor" ? (approved = false) : (approved = true);

      //entry create in DB
      const profileDetails = await Profile.create({
          gender:null,
          dateOfBirth: null,
          about:null,
          contactNumber:null,
      });
      console.log("Data received in signup is" ,firstName )
      const user = await User.create({
          firstName,
          lastName,
          email,
          // contactNumber,
          password:hashedPwd,
          accountType,
          approved: approved, //E
          additionalDetails:profileDetails._id,
          image: `https://api/dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`  //dicebear generates your pfp from firstname and lastname
        })
        console.log("Data created successfully");//E
      //return res
      return res.status(200).json({
        success:true,
        message:'User is registered Successfully.',
        // user,
        newUser,
      });
   }
   catch(error){
     console.log(error);
     return res.status(500).json({
       success:false,
       message:"User cannot be registered. Please try again"
     })
   }

}

//Login
exports.login = async(req, res) => {
  try{
      //get data from req body
      const {email, password} = req.body;
      //validation data
      if(!email || !password){
        //  return res.status(403).json({
          return res.status(400).json({
            success:false,
            // message:'All fields are required, please try again',
            message:'Email or Password empty',
         });
      }
      //user check exist or not
      // const user = await User.findOne({email}).populate("additionalDetails");
      const existingUser = await User.findOne({email}).populate("additionalDetails").exec();
      if(!existingUser){
        //  return res.status(401).json({
          return res.status(400).json({
            success:false,
            // message:"User is not registered, pleasesignup first",
            message:'Email not registered',
         });
      }
      //generate JWT, after password matching
      // if(await bcrypt.compare(password,user.password)){
      //    const payload = {  //generating token
      //      email:user.email,
      //      id:user._id,
      //      accountType:user.accountType,
      //    }
      if (await bcrypt.compare(password, existingUser.password)) {
        const payload = {
            email:email,
            accountType: existingUser.accountType,
            id: existingUser._id
        }
         const token = jwt.sign(payload, process.env.JWT_SECRET,{
           expiresIn:"2h",
         });
        //  user.token = token;
        //  user.password = undefined;
        existingUser.toObject();
            existingUser.token = token;
            existingUser.password = undefined;

         //create cookie and send response
         const options = {
            expires : new Date(Date.now() + 3*24*60*60*1000),
            httpOnly:true,
         }
         res.cookie("token", token, options).status(200).json({
          //  success:true,
          //  token,
          //  user,
          //  message:'Logged in successfully',
          success:true,
          message:'Login successfull',
          token, 
          existingUser
         })
      }
      else{
         return res.status(401).json({
            success:false,
            message:'Password is incorrect.',
         });
      }
  }
  catch(error){
    console.log(error);
    return res.status(500).json({
       success:false,
       message:'Login Failure, please try again',
    });
  }
};


//changePassword
//TODO:HOMEWORK
exports.changePassword = async (req, res) => {
	try {
		// Get user data from req.user
		const userDetails = await User.findById(req.user.id);

		// Get old password, new password, and confirm new password from req.body
		const { oldPassword, newPassword } = req.body;

		// Validate old password
		const isPasswordMatch = await bcrypt.compare(
			oldPassword,
			userDetails.password
		);
		if (!isPasswordMatch) {
			// If old password does not match, return a 401 (Unauthorized) error
			return res
				.status(401)
				.json({ success: false, message: "The password is incorrect" });
		}

		// Match new password and confirm new password
		// if (newPassword !== confirmNewPassword) {
		// 	// If new password and confirm new password do not match, return a 400 (Bad Request) error
		// 	return res.status(400).json({
		// 		success: false,
		// 		message: "The password and confirm password does not match",
		// 	});
		// }

		// Update password
		const encryptedPassword = await bcrypt.hash(newPassword, 10);
		const updatedUserDetails = await User.findByIdAndUpdate(
			req.user.id,
			{ password: encryptedPassword },
			{ new: true }
		);

		// Send notification email-pwd updated
		try {
			const emailResponse = await mailSender(
				updatedUserDetails.email,
				passwordUpdated(
					updatedUserDetails.email,
					`Password updated successfully for ${updatedUserDetails.firstName} ${updatedUserDetails.lastName}`
				)
			);
			console.log("Email sent successfully:", emailResponse.response);
		} catch (error) {
			// If there's an error sending the email, log the error and return a 500 (Internal Server Error) error
			console.error("Error occurred while sending email:", error);
			return res.status(500).json({
				success: false,
				message: "Error occurred while sending email",
				error: error.message,
			});
		}

		// Return success response
		return res
			.status(200)
			.json({ success: true, message: "Password updated successfully" });
	} catch (error) {
		// If there's an error updating the password, log the error and return a 500 (Internal Server Error) error
		console.error("Error occurred while updating password:", error);
		return res.status(500).json({
			success: false,
			message: "Error occurred while updating password",
			error: error.message,
		});
	}
};