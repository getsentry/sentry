import { useContext } from "react";
import { PokemonContext } from "../contexts/PokemonProvider";

export const usePokemonSetter = () => {
  const context = useContext(PokemonContext);
  if (context === undefined)
    throw new Error("usePokemonSetter must be used within a PokemonProvider");
  const { state, ...rest } = context;
  return rest;
};
