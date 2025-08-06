// import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
// import { storage } from "./firebase";

// const upload = async (file) => {
//     const date = new Date().getTime();  // ✅ حولنا التاريخ لرقم (timestamp)
//     const storageRef = ref(storage, `images/${date}_${file.name}`); // ✅ استخدمنا underscore للفصل

//     const uploadTask = uploadBytesResumable(storageRef, file);

//     return new Promise((resolve, reject) => {
//         uploadTask.on(
//             'state_changed',
//             (snapshot) => {
//                 const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
//                 console.log('Upload is ' + progress + '% done');
//             },
//             (error) => {
//                 reject("Something went wrong! " + error.code);
//             },
//             () => {
//                 getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
//                     resolve(downloadURL);
//                 });
//             }
//         );
//     });
// };

// export default upload;
// const cloudinary = require("cloudinary")

// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME
// })
// const upload = async (file) => {
//     const data = new FormData();
//     data.append("file", file);
//     data.append("upload_preset", "unsigned_preset"); // اسم الـ preset اللي عملته
//     data.append("cloud_name", cloud_name);    // استبدل بـ cloud name بتاعك

//     try {
//         const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
//             method: "POST",
//             body: data
//         });

//         const result = await res.json();
//         return result.secure_url;  // ده رابط الصورة النهائي
//     } catch (err) {
//         console.error("Upload failed:", err);
//         throw err;
//     }
// };

// export default upload;

const upload = async (file) => {
    const cloud_name = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "unsigned_preset");
    data.append("cloud_name", cloud_name); // ده اختياري أصلاً بس ماشي تمام

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
            method: "POST",
            body: data,
        });

        const result = await res.json();
        return result.secure_url;
    } catch (err) {
        console.error("Upload failed:", err);
        throw err;
    }
};

export default upload;