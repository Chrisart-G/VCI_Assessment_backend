// backend/src/middlewares/auth.js
import { auth, db } from '../config/firebase.js'

/**
 * Verify Firebase ID token from Authorization header
 */
export async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      })
    }
    
    const token = authHeader.split('Bearer ')[1]
    const decodedToken = await auth.verifyIdToken(token)
    
    console.log('✅ Token verified for user:', decodedToken.uid)
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      ...decodedToken
    }
    
    next()
  } catch (error) {
    console.error('❌ Auth Error:', error)
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    })
  }
}

/**
 * Check if user is admin - FIXED with better error handling
 */
export async function checkAdmin(req, res, next) {
  try {
    const userId = req.user.uid
    
    console.log('🔍 Checking admin status for user:', userId)
    
    // First, check if the user profile exists
    const userRef = db.collection('users').doc(userId)
    const userDoc = await userRef.get()
    
    if (!userDoc.exists) {
      console.log('❌ User profile not found for:', userId)
      
      // Try to find by email as fallback
      const email = req.user.email
      if (email) {
        console.log('🔍 Looking up user by email:', email)
        const snapshot = await db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get()
        
        if (!snapshot.empty) {
          const doc = snapshot.docs[0]
          const userData = doc.data()
          console.log('✅ Found user by email:', doc.id)
          
          if (userData.role === 'admin') {
            req.userProfile = { id: doc.id, ...userData }
            return next()
          }
        }
      }
      
      return res.status(404).json({ 
        success: false, 
        message: 'User profile not found' 
      })
    }
    
    const userData = userDoc.data()
    console.log('📋 User role:', userData.role)
    
    if (userData.role !== 'admin') {
      console.log('❌ User is not an admin (role:', userData.role, ')')
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      })
    }
    
    console.log('✅ User is admin, granting access')
    req.userProfile = { id: userId, ...userData }
    next()
  } catch (error) {
    console.error('❌ Admin check error:', error)
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
}