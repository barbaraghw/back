
// This file specifically describes the user object after JWT authentication.

export interface IAuthenticatedUser {
    _id: string; // The ID will be a string from the JWT payload
    email: string;
    username: string;
    // Add any other properties you include in your JWT token payload
}