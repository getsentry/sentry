import * as ACTIONS from "./actionTypes";

export const initialState = {
  pokemonsList: [],
  id: null,
  isLoading: true,
};

export const reducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_POKEMONS_LIST:
      return {
        ...state,
        pokemonsList: [...state.pokemonsList, ...action.payload],
      };

    case ACTIONS.SET_POKEMON_DATA:
      return {
        ...state,
        pokemonData: action.payload,
      };

    case ACTIONS.SET_POKEMON_SPECIES_DATA:
      return {
        ...state,
        pokemonSpeciesData: action.payload,
      };

    case ACTIONS.SET_POKEMON_ID:
      return {
        ...state,
        id: action.payload,
      };

    case ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    case ACTIONS.SET_LOADING_NEXT_BATCH:
      return {
        ...state,
        isLoadingNextBatch: action.payload,
      };

    default:
      return state;
  }
};
