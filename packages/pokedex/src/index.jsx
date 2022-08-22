import { createRoot } from "react-dom/client";
import Router from "./routes/Router";
import "./styles/globals.scss";

const root = createRoot(document.getElementById("root"));
root.render(<Router />);
