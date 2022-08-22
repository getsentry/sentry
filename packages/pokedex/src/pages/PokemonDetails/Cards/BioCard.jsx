import { getPokemonBio } from "../../../utils/utils";
import Stats from "./Stats";
import { usePokemonState } from "../../../hooks";

export const BioCard = () => {
  const { pokemonSpeciesData, pokemonData } = usePokemonState();
  return (
    <div className="bio-container">
      {pokemonSpeciesData ? (
        <>
          <p>
            <b className="title">Bio</b> <br />
            {getPokemonBio(pokemonData, pokemonSpeciesData)}
          </p>
          <Stats stats={pokemonData.stats} />
        </>
      ) : null}
    </div>
  );
};
