import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    email: string;
    password: string;
    username: string;
    isCritic: boolean;
    comparePassword: (candidatePassword: string) => Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    email: { type: String, required: true, unique: true, trim: true,minlength: [5, 'El email debe tener al menos 5 caracteres.'], maxlength: [50, 'El email no puede exceder los 50 caracteres.'], match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Por favor, introduce un email válido.'] },
    password: { type: String, required: true, minlength: [3, 'La contraseña debe tener al menos 3 caracteres.']},
    username: { type: String, required: true, unique: true,  minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres.'], maxlength: [30, 'El nombre de usuario no puede exceder los 30 caracteres.'], },
    isCritic: { type: Boolean, default: false }
});

// Hash de la contraseña antes de guardar
UserSchema.pre<IUser>('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Método para comparar contraseñas
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);