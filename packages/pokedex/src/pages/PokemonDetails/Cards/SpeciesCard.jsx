import {
  findEngLang,
  capitalize,
  formatGeneration,
} from "../../../utils/utils";
import Row from "../../../components/Row/Row";
import { usePokemonState } from "../../../hooks";

export const SpeciesCard = () => {
  const { pokemonSpeciesData, pokemonData } = usePokemonState();

  return pokemonSpeciesData ? (
    <div className="species-col">
      <p className="title">Species</p>
      <Row
        category="Genus:"
        value={findEngLang(pokemonSpeciesData.genera).genus}
      />
      <Row category="Height:" value={`${pokemonData.height / 10} m`} />
      <Row category="Weight:" value={`${pokemonData.weight / 10} kg`} />
      <Row
        category="Gen:"
        value={formatGeneration(pokemonSpeciesData?.generation?.name)}
      />
      <Row
        category="Habitat:"
        value={capitalize(pokemonSpeciesData?.habitat?.name)}
      />
      <Row
        category="Shape:"
        value={capitalize(pokemonSpeciesData?.shape?.name)}
      />
    </div>
  ) : null;
};
