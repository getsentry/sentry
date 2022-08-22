import { useContext } from "react";
import { PokemonContext } from "../contexts/PokemonProvider";

export const usePokemonState = () => {
  const context = useContext(PokemonContext);
  if (context === undefined)
    throw new Error("usePokemonState must be used within a PokemonProvider");
  return context.state;
};
