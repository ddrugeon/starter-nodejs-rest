const crypt = require('../services/crypt');
const email = require('../services/email');
const tokenService = require('../services/token');
const q = require('q');
const userRepository = require('../repositories/user');
const userValidation = require('../validations/user');
const url = require('url');

function checkReset(req, res, next) {
    const username = req.params.username;

    function validateToken(userFound) {
        return tokenService.validateToken(req, userFound.password);
    }

    userRepository.findByUsername(username)
        .then(userValidation.validateToLogin)
        .then(validateToken)
        .then(() => {
            res.end();
        })
        .catch(next);
}

function forgot(req, res, next) {
    const user = {
        email: req.body.email
    };

    if (!user.email) {
        next({ status: 400, content: 'You must send the email' });
        return;
    }

    userRepository.findOne(user).then((userFound) => {
        if (!userFound) {
            return;
        }

        const token = tokenService.createToken({ username: userFound.username }, 86400, userFound.password);

        const recoveryUrl = url.format({
            protocol: req.protocol,
            host: req.get('host'),
            pathname: `reset/${userFound.username}/${token}`
        });

        const emailConfig = {
            to: user.email,
            subject: '[Starter] - Recover your password'
        };

        const emailData = {
            recoveryUrl
        };

        email.sendMail(emailConfig, emailData, 'email-reset.html');
    }).catch(next);

    res.end();
}

function login(req, res, next) {
    const user = {
        username: req.body.username,
        password: req.body.password
    };

    function comparePassword(userFound) {
        return crypt.compare(user.password, userFound.password);
    }

    userValidation.validateRequired(user)
        .then(userRepository.findByUsername)
        .then(userValidation.validateToLogin)
        .then(comparePassword)
        .then(() => {
            res.header('authorization', tokenService.createToken({ username: user.username }));
            res.end();
        })
        .catch(next);
}

function register(req, res, next) {
    const user = req.body;

    function hashPassword() {
        return crypt.hash(user.password);
    }

    function setHashedPassword(hash) {
        user.password = hash;
        return q.resolve(user);
    }

    function sendWelcome() {
        if (user.email) {
            const emailConfig = {
                to: user.email,
                subject: `[Starter] - Welcome ${user.username}`
            };

            const emailData = {
                name: user.username
            };

            email.sendMail(emailConfig, emailData, 'welcome.html');
        }
    }

    userValidation.validateRequired(user)
        .then(userRepository.findByUsername)
        .then(userValidation.validateToInsert)
        .then(hashPassword)
        .then(setHashedPassword)
        .then(userRepository.insert)
        .then(() => {
            res.header('authorization', tokenService.createToken({ username: user.username }));
            res.status(201).end();
            sendWelcome();
        })
        .catch(next);
}

function reset(req, res, next) {
    const user = {
        username: req.body.username,
        password: req.body.password
    };

    function validateToken(userFound) {
        return tokenService.validateToken(req, userFound.password);
    }

    function hashPassword() {
        return crypt.hash(user.password);
    }

    function updateUser(hashResult) {
        return userRepository.update({ username: user.username }, { password: hashResult });
    }

    userValidation.validateRequired(user)
        .then(userRepository.findByUsername)
        .then(userValidation.validateToLogin)
        .then(validateToken)
        .then(hashPassword)
        .then(updateUser)
        .then(() => {
            res.end();
        })
        .catch(next);
}

module.exports = {
    checkReset,
    forgot,
    login,
    register,
    reset
};
