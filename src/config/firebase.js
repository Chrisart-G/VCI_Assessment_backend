import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import dotenv from 'dotenv'

dotenv.config()

try {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL

  if (!privateKey || !projectId || !clientEmail) {
    throw new Error('Missing required Firebase environment variables')
  }

  console.log('Initializing with env vars for:', projectId)

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    })
  })

  console.log('✅ Firebase initialized successfully')
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message)
  process.exit(1)
}

const db = getFirestore()
const auth = getAuth()

export { db, auth }