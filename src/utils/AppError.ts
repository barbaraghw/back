class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message); // Call the parent Error constructor
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Mark as an operational error

        Error.captureStackTrace(this, this.constructor); // Capture stack trace
    }
}

export default AppError;