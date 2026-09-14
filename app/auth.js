const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET belum dikonfigurasi"
    );
  }

  return secret;
}


function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    getJwtSecret(),
    {
      expiresIn: "8h"
    }
  );
}


function requireAuth(req, res, next) {
  try {
    const authorization =
      req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication diperlukan"
      });
    }

    const token =
      authorization.substring(7);

    const payload =
      jwt.verify(
        token,
        getJwtSecret()
      );

    req.user = {
      id: Number(payload.sub),
      username: payload.username,
      role: payload.role
    };

    next();

  } catch (error) {
    return res.status(401).json({
      error: "Token tidak valid atau sudah expired"
    });
  }
}


function requireRole(...allowedRoles) {
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({
        error: "Authentication diperlukan"
      });
    }

    if (
      !allowedRoles.includes(
        req.user.role
      )
    ) {
      return res.status(403).json({
        error: "Akses ditolak"
      });
    }

    next();
  };
}


module.exports = {
  createToken,
  requireAuth,
  requireRole
};