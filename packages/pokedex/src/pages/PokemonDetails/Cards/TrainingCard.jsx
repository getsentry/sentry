import { Fragment } from "react";
import Row from "../../../components/Row/Row";
import { formatKebabCase } from "../../../utils/utils";
import { usePokemonState } from "../../../hooks";

export const TrainingCard = () => {
  const { pokemonSpeciesData, pokemonData } = usePokemonState();
  return pokemonSpeciesData ? (
    <div className="training-col">
      <p className="title">Training</p>
      <Row category="Base Experience:" value={pokemonData.base_experience} />
      <Row
        category="Base Happiness:"
        value={pokemonSpeciesData.base_happiness}
      />
      <Row category="Capture Rate:" value={pokemonSpeciesData.capture_rate} />
      <Row
        category="Growth Rate:"
        value={formatKebabCase(pokemonSpeciesData.growth_rate.name, " - ")}
      />
      <Row
        category="Abilities:"
        value={
          <div className="abilities-col">
            {pokemonData.abilities.map((ability, index) => (
              <Fragment key={ability.ability.name}>
                <p>{`${index + 1}. ${formatKebabCase(
                  ability.ability.name
                )}`}</p>
                {ability.is_hidden && <span>(Hidden Ability)</span>}
              </Fragment>
            ))}
          </div>
        }
      />
    </div>
  ) : null;
};
