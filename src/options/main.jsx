import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import { OptionsApp } from "./OptionsApp.jsx";
import "./options.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
