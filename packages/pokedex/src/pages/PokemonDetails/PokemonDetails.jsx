import {useEffect, useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {Button as LibButton} from 'design-system';
import {capitalize, documentTitle, COLOR, formatId} from '../../utils/utils';
import Header from '../../components/Header/Header';
import Button from '../../components/Button/Button';
import PokemonCard from '../../components/PokemonCard/PokemonCard';
import Loader from '../Loader/Loader';
import {BioCard, SpeciesCard, TrainingCard} from './Cards';
import {usePokemonState, usePokemonSetter} from '../../hooks';
import {ROUTES} from '../../constants/routepaths';
import {PreviousIcon, NextIcon, BackArrow} from '../../icons';
import './PokemonDetails.scss';

const POKEMON_ID = {
  FIRST: 1,
  LAST: 898,
};

const PokemonDetails = ({path}) => {
  const [move, setMove] = useState();
  const routeParams = useParams();
  const id = +routeParams.id;
  const navigate = useNavigate();
  const {pokemonData, pokemonSpeciesData} = usePokemonState();
  const {setPokemonId} = usePokemonSetter();
  const isFirstPokemon = id === POKEMON_ID.FIRST;
  const isLastPokemon = id === POKEMON_ID.LAST;

  const launchHomePage = () => {
    documentTitle.reset();
    navigate(`${path}${ROUTES.HOME}`);
  };

  const onSelect = direction => {
    if (direction === -1 && isFirstPokemon) {
      launchHomePage();
      return;
    }

    if (direction === 1 && isLastPokemon) return;
    navigate(`${path}${ROUTES.DETAILS}/${id + direction}`);
  };

  const onKeyUp = ({key}) => {
    if (key === 'ArrowLeft') onSelect(-1);
    if (key === 'ArrowRight') onSelect(1);
  };

  useEffect(() => {
    setPokemonId(id);
    setMove('');
  }, [id]);

  useEffect(() => {
    documentTitle.set(pokemonData?.name);
  }, [pokemonData]);

  useEffect(() => {
    document.addEventListener('keyup', onKeyUp);
    return () => document.removeEventListener('keyup', onKeyUp);
  }, [id]);

  const pokemonType = pokemonData?.types[0].type.name;
  const buttonStyles = {
    '--button-hover-bg-clr': COLOR.RGBA(pokemonType),
    '--button-border-clr': COLOR.TYPE(pokemonType),
  };

  const getMove = () => {
    const {moves} = pokemonData;
    const randMove = moves[Math.floor(Math.random() * moves.length)];
    setMove(randMove);
  };

  return !pokemonData && !pokemonSpeciesData ? (
    <Loader />
  ) : (
    <main className="details">
      <Header
        style={{
          backgroundColor: COLOR.TYPE(pokemonType),
        }}
      >
        <button type="button" onClick={launchHomePage}>
          <BackArrow />
        </button>
        <div className="details-header">
          <p>#{formatId(id)}</p>
          <p>{capitalize(pokemonData?.name)}</p>
        </div>
      </Header>

      <div className="button-container">
        <Button
          onClick={() => onSelect(-1)}
          style={{
            ...buttonStyles,
            visibility: !isFirstPokemon ? 'visible' : 'hidden',
          }}
        >
          <PreviousIcon />
        </Button>

        <Button
          onClick={() => onSelect(1)}
          style={{
            ...buttonStyles,
            visibility: !isLastPokemon ? 'visible' : 'hidden',
          }}
        >
          <NextIcon />
        </Button>
      </div>

      <div className="grid-row">
        <div className="card-wrapper">
          <PokemonCard pokemonData={pokemonData} disableClick path={path} />
        </div>
        <BioCard />
      </div>

      <div className="grid-row-2">
        <TrainingCard />
        <SpeciesCard />
      </div>
      <div>
        <LibButton label="Get Move" onClick={getMove} primary />
        {/* <button type="button" onClick={getMove}>Get Move</button> */}
        {move && <div>Name: {move.move.name}</div>}
      </div>
    </main>
  );
};

export default PokemonDetails;
