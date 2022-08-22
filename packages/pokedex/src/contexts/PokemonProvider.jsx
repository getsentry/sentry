import { createContext, useReducer, useRef, useEffect } from "react";
import { reducer, initialState } from "./reducer";
import * as ACTIONS from "./actionTypes";
import {
  initialURL,
  fetchSpeciesData,
  fetchPokemonData,
} from "../utils/pokemon_helper";

export const PokemonContext = createContext(initialState);

export const PokemonProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const batchURL = useRef(initialURL);

  const setPokemonsList = (pokemons) => {
    dispatch({
      type: ACTIONS.SET_POKEMONS_LIST,
      payload: pokemons,
    });
  };

  const setPokemonData = (pokemon) => {
    dispatch({
      type: ACTIONS.SET_POKEMON_DATA,
      payload: pokemon,
    });
  };

  const setPokemonSpeciesData = (pokemon) => {
    dispatch({
      type: ACTIONS.SET_POKEMON_SPECIES_DATA,
      payload: pokemon,
    });
  };

  const setPokemonId = (id) => {
    dispatch({
      type: ACTIONS.SET_POKEMON_ID,
      payload: id,
    });
  };

  const setLoading = (loading) => {
    dispatch({
      type: ACTIONS.SET_LOADING,
      payload: loading,
    });
  };

  const setLoadingNextBatch = (loading) => {
    dispatch({
      type: ACTIONS.SET_LOADING_NEXT_BATCH,
      payload: loading,
    });
  };

  const loadPokemons = async () => {
    if (!batchURL.current || state.isLoadingNextBatch) return;
    setLoadingNextBatch(true);
    const resp = await fetch(batchURL.current);
    const { next, results } = await resp.json();

    batchURL.current = next;

    const pokemonsList = await Promise.all(
      results.map(async (pokemon) => {
        const response = await fetch(pokemon.url);
        const res = response.json();
        return res;
      })
    );

    setPokemonsList(pokemonsList);
    setLoadingNextBatch(false);
  };

  useEffect(() => {
    if (!state.id) return;
    (async function setPokemonDetails() {
      const pokemonData = await fetchPokemonData(state.id);
      setPokemonData(pokemonData);
      const pokemonSpeciesData = await fetchSpeciesData(state.id);
      setPokemonSpeciesData(pokemonSpeciesData);
    })();
  }, [state.id]);

  useEffect(() => {
    loadPokemons().then(() => state.isLoading && setLoading(false));
  }, []);

  return (
    <PokemonContext.Provider
      // eslint-disable-next-line react/jsx-no-constructed-context-values
      value={{
        state,
        dispatch,
        setPokemonId,
        loadPokemons,
      }}
    >
      {children}
    </PokemonContext.Provider>
  );
};
