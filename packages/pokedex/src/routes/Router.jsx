import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ROUTES } from "../constants/routepaths";
import Home from "../pages/Home/Home";
import { PokemonProvider } from "../contexts/PokemonProvider";
import Loader from "../pages/Loader/Loader";

const PokemonDetails = lazy(() =>
  import(/* webpackPrefetch: true */ "../pages/PokemonDetails/PokemonDetails")
);

const Router = ({path = ''}) => (
  <PokemonProvider path={path}>
    <Suspense fallback={<Loader />}>
      <BrowserRouter>
        <Routes>
          <Route path={`${path}${ROUTES.HOME}`} element={<Home path={path}/>} />
          <Route path={`${path}${ROUTES.DETAILS}/:id`} element={<PokemonDetails path={path}/>} />
        </Routes>
      </BrowserRouter>
    </Suspense>
  </PokemonProvider>
);

export default Router;
