// src/config/firebase.js
import admin from 'firebase-admin';

// Ensure the SDK is initialized only once
if (!admin.apps.length) {
  try {
    // All sensitive values are pulled from environment variables
    const firebaseConfig = {
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // The private key from Render is now read directly. 
        // The SDK handles the multi-line format automatically.
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    };

    // Log a safe check to confirm variables are loaded (don't log the key!)
    console.log(`Initializing Firebase Admin for project: ${process.env.FIREBASE_PROJECT_ID}`);
    console.log(`Client email: ${process.env.FIREBASE_CLIENT_EMAIL}`);
    console.log(`Database URL: ${process.env.FIREBASE_DATABASE_URL}`);

    admin.initializeApp(firebaseConfig);
    console.log('✅ Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('❌ CRITICAL: Failed to initialize Firebase Admin SDK:', error);
    // In a production environment, you might want to exit the process
    // process.exit(1);
  }
}

const db = admin.firestore();

// Export both admin and db for use in other parts of your application
export { admin, db };