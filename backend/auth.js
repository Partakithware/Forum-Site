import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import db from './database.js';

// Get user by username
const getUserByUsername = (username) => {
  console.log('Looking up user:', username);
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get([username]);
  console.log('Found user:', user);
  return user;
};

// Get user by ID
const getUserById = (id) => {
  console.log('Looking up user by ID:', id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get([id]);
  console.log('Found user by ID:', user);
  return user;
};

// Configure passport local strategy
passport.use(new LocalStrategy((username, password, done) => {
  console.log('LocalStrategy: Attempting login for:', username);
  const user = getUserByUsername(username);
  
  if (!user) {
    console.log('LocalStrategy: User not found');
    return done(null, false, { message: 'Incorrect username.' });
  }
  
  console.log('LocalStrategy: User found, checking password...');
  bcrypt.compare(password, user.password, (err, result) => {
    if (err) {
      console.log('LocalStrategy: bcrypt error:', err);
      return done(err);
    }
    if (!result) {
      console.log('LocalStrategy: Password incorrect');
      return done(null, false, { message: 'Incorrect password.' });
    }
    console.log('LocalStrategy: Login successful!');
    return done(null, user);
  });
}));

passport.serializeUser((user, done) => {
  console.log('Serializing user:', user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  console.log('Deserializing user:', id);
  // IMPORTANT: Always fetch fresh user data to get current role
  const user = getUserById(id);
  done(null, user);
});

export default passport;