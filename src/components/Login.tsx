import React from "react";
import { stepture } from "../constants/images";
import Button from "./Button";

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL;

export const Login: React.FC = () => {
  const loginWithGoogle = () => {
    window.open(`${FRONTEND_URL}/login`, "_blank");
  };

  return (
    <div className="flex items-center justify-center flex-col w-full px-4 py-2">
      <img src={stepture} alt="Stepture Logo" className="w-20 h-20 mb-4" />
      <h2 className="text-xl font-bold text-blue mb-2">Welcome to Stepture</h2>
      <p className="text-gray text-sm mb-6">Sign in to continue</p>

      <Button
        color="google"
        text="Sign in with Google"
        onClick={loginWithGoogle}
      />
    </div>
  );
};
