const express = require('express');
const productmodel = require('../models/productmodel');
const usermodel = require('../models/usermodel');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const configuration = require('../config/default.json');
const mailgun = require('mailgun-js')({ apiKey: configuration.mailgun.api_keyI + configuration.mailgun.api_keyIII + configuration.mailgun.api_keyII + "-3cac0f9b", domain: configuration.mailgun.domain });
const router = express.Router();

router.get('/', async function (req, res) {
    await productmodel.refresh();
    var end = await productmodel.end();
    var price = await productmodel.price();
    var bid = await productmodel.bid();

    res.render('./', {
        end: end,
        price: price,
        bid: bid,
    });
});

router.get('/login', async function (req, res) {
    if (req.headers.referer.indexOf("/login") != -1 && req.headers.referer.indexOf("/registers") != -1 && req.headers.referer.indexOf('/otp') != -1)
        req.session.previous = req.headers.referer;

    res.render('./login');
});

router.post('/login', async function (req, res) {
    var user = await usermodel.check(req.body.email);
    user = user[0];
    if (user == undefined)
        return res.render('./login', {
            announce: 'Invalid username or password.'
        });

    const rs = bcrypt.compareSync(req.body.password, user.password);
    if (rs === false)
        return res.render('./login', {
            announce: 'Invalid username or password.'
        });

    delete user.password;
    req.session.authenticated = false;
    req.session.user = user;
    const otp = Math.floor(100000 + Math.random() * 900000);
    const entity = {
        otp: otp,
        email: user.email
    }

    await usermodel.otp(entity)

    const data = {
        from: 'Web Nerdy Team <Zerd@WNT.com>',
        to: req.session.user.email,
        subject: 'Online Auction',
        text: `Here is your one-time-passcode\n${otp}\nTo complete your process, enter the code in the web page when you requested it.\nNOTE: This one-time-passcode expires 15 minutes after it was requested.`
    };

    mailgun.messages().send(data);

    req.session.save(function () {
        return res.redirect('/otp');
    });
});

router.get('/logout', async function (req, res) {
    req.session.authenticated = false;
    req.session.user = null;
    if (req.headers.referer)
        if (req.headers.referer.indexOf("account") != -1)
            return req.session.save(function () {
                return res.redirect('/');
            });

    req.session.save(function () {
        return res.redirect(req.headers.referer);
    });
});

router.get('/register', async function (req, res) {
    res.render('./register');
});

router.post('/register', async function (req, res) {
    var checking = await usermodel.check(req.body.register_email);
    if (checking.length == 0) {
        const hash = bcrypt.hashSync(req.body.register_password, configuration.authentication.saltRounds);
        const entity = {
            name: req.body.register_name,
            email: req.body.register_email,
            password: hash
        }

        await usermodel.add(entity);
        var user = await usermodel.check(entity.email);
        user = user[0];
        const data = {
            from: 'Web Nerdy Team <Zerd@WNT.com>',
            to: user.email,
            subject: 'Online Auction',
            text: `Hi,\nThanks for joining WNT Online Auction! Please confirm your email address by clicking on the link below. We'll communicate with you from time to time via email so it's important that we have an up-to-date email address on file.\nhttp://localhost:5000/account/active/${user.id}\nIf you did not sign up for a WNT account please disregard this email.\nHappy emailing!\nAdministrators`
        };

        mailgun.messages().send(data);

        res.render('./login', {
            announce: "Signup complete! We've sent you a mail to confirm, please follow the link inside to active your account."
        });
    } else {
        res.render("./register", {
            name: req.body.register_name,
            email: req.body.register_email,
            password: req.body.register_password,
            repeat: req.body.register_repeat,
            error: "This email address is already being used!"
        });
    }
})

router.get('/404', async function (req, res) {
    res.render('./404');
});

router.get('/otp', async function (req, res) {
    if (req.headers.referer.indexOf("/login") != -1 && req.headers.referer.indexOf("/registers") != -1 && req.headers.referer.indexOf('/otp') != -1)
        req.session.previous = req.headers.referer;

    res.render('./otp');
});

router.post('/otp', async function (req, res) {
    var otp = req.body.otp;

    var target = await usermodel.verify(req.session.user.email)
    if (target.length == 0) {
        return res.render('./otp', {
            announce: 'Something went wrong, please re-login!'
        })
    }

    target = target[0];
    if (moment().isBefore(target.end)) {
        if (otp === target.otp) {
            req.session.authenticated = true;

            const url = req.session.previous;
            delete req.session.previous;

            if (req.session.user.privilege == null)
                return req.session.save(function () {
                    return res.redirect('/account/reminder');
                });

            else if (req.session.user.privilege == "admin")
                return req.session.save(function () {
                    return res.redirect('/account/admin');
                });

            else if (url)
                return req.session.save(function () {
                    return res.redirect(url);
                });
            else
                return req.session.save(function () {
                    return res.redirect('./');
                });
        }
        else {
            return res.render('./otp', {
                announce: 'Invalid OTP!'
            })
        }
    }

    otp = Math.floor(100000 + Math.random() * 900000);
    const entity = {
        otp: otp,
        email: req.session.user.email
    }

    await usermodel.otp(entity)

    const data = {
        from: 'Web Nerdy Team <Zerd@WNT.com>',
        to: req.session.user.email,
        subject: 'Online Auction',
        text: `Here is your one-time-passcode\n${otp}\nTo complete your process, enter the code in the web page when you requested it.\nNOTE: This one-time-passcode expires 15 minutes after it was requested.`
    };

    mailgun.messages().send(data);

    res.render('./otp', {
        announce: 'OTP expires. We have sent new one to your email!'
    });
});

module.exports = router;