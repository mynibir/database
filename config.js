// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD-AUFMFLhZ4wYma78LbtKil1Rcmk_Q8Kg",
    authDomain: "dashboard-config-ace02.firebaseapp.com",
    projectId: "dashboard-config-ace02",
    storageBucket: "dashboard-config-ace02.firebasestorage.app",
    messagingSenderId: "166283646188",
    appId: "1:166283646188:web:5e7f1ffd9a0d414f9881c9",
    measurementId: "G-52F0L8BCMJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
