import { db } from '../config/firebase.js'

/**
 * Create or update user profile
 */
export const createProfile = async (req, res) => {
  try {
    const { uid } = req.params
    const profileData = req.body

    console.log('📝 Creating profile for user:', uid)
    console.log('📝 Profile data:', JSON.stringify(profileData, null, 2))

    // Validate required fields
    if (!profileData.email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      })
    }

    // Save to Firestore users collection
    await db.collection('users').doc(uid).set({
      ...profileData,
      uid,
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true })

    console.log('✅ Profile created successfully')

    res.status(201).json({
      success: true,
      message: 'Profile created successfully',
      data: {
        uid,
        ...profileData
      }
    })
  } catch (error) {
    console.error('❌ Create profile error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create profile'
    })
  }
}

/**
 * Get user profile
 */
export const getProfile = async (req, res) => {
  try {
    const { uid } = req.params

    console.log('📝 Fetching profile for user:', uid)

    const userDoc = await db.collection('users').doc(uid).get()

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      })
    }

    const userData = userDoc.data()

    console.log('✅ Profile fetched successfully')

    res.status(200).json({
      success: true,
      data: userData
    })
  } catch (error) {
    console.error('❌ Get profile error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch profile'
    })
  }
}

/**
 * Update user profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { uid } = req.params
    const updates = req.body

    console.log('📝 Updating profile for user:', uid)
    console.log('📝 Updates:', JSON.stringify(updates, null, 2))

    // Check if user exists
    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      })
    }

    // Update the profile
    await db.collection('users').doc(uid).update({
      ...updates,
      updatedAt: new Date()
    })

    console.log('✅ Profile updated successfully')

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        uid,
        ...updates
      }
    })
  } catch (error) {
    console.error('❌ Update profile error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile'
    })
  }
}
