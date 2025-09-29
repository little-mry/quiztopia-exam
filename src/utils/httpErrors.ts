//since package "http-errors" don't work well with ts, I built my own :) 
// works together w errorHandler
export class HttpError extends Error {
  statusCode: number;
  expose: boolean;
  constructor(
    statusCode = 500,
    message = "Ett oväntat fel inträffade",
    expose = false
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict") {
    super(409, message, true);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad Request") {
    super(400, message, true);
  }
}
export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, message, true);
  }
}
export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, message, true);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = "Internal Server Error") {
    super(500, message, false);
  }
}
