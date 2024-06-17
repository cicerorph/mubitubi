const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const Josh = require('@joshdb/core');
const provider = require("@joshdb/json");
const { ensureAuthenticated } = require('../utils/util');

module.exports = (app) => {
  const db = new Josh({
    name: 'auth',
    provider
  });

  passport.serializeUser((user, done) => {
    done(null, user.userId); // Serialize by Discord userId
  });

  passport.deserializeUser(async (userId, done) => {
    try {
      const user = await db.get(userId);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await db.get(profile.id);
      if (!user) {
        user = {
          userId: profile.id,
          username: profile.username,
          global_name: profile.global_name,
          discriminator: profile.discriminator,
          avatar: profile.avatar,
          email: profile.email,
          isStaff: false
        };

        await db.set(profile.id, user);
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));

  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/auth/discord', passport.authenticate('discord'));

  app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
      res.redirect('/');
  });

  app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.redirect('/');
    });
  });

  app.get('/auth/makeStaff', ensureAuthenticated, async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).send('No user ID provided.');
    }

    try {
      const user = await db.get(userId); 
      if (!user) {
        return res.status(404).send('User not found.');
      }

      user.isStaff = true;
      await db.set(userId, user);

      res.status(200).send('User promoted to staff successfully.');
    } catch (error) {
      res.status(500).send('Error promoting user to staff.');
    }
  });
};
