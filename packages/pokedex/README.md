<br/>

  <h1 align="center">Pokédex</h1>

  <p align="center">
    Pokédex built with React and PokéAPI, infinite scrolling of pokemon cards implemented using <a href="https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API" target="_blank">Intersection Observer API</a>.
    <br />
    <br />
    <a href="https://pokedex.shanpriyan.in/" target="_blank"  >View Demo</a>
  </p>
</p>

<br />

### Project Summary

- Pokemon Data from [PokéAPI](https://pokeapi.co/)
- UI components with [React.js](https://reactjs.org/)
- State management using React's [Context-API](https://reactjs.org/docs/context.html)
- Styling with [Sass](https://sass-lang.com/)
- Bundling with [webpack](https://webpack.js.org/)
- Linting with [ESLint](https://eslint.org/)
- Code formatting with [Prettier](https://prettier.io/)

<br />

## Development

Steps to run Pokédex in your local environment.

1. Clone the repository

   ```sh
   git clone https://github.com/shanpriyan/pokedex.git
   ```

2. Go to the project directory

   ```sh
   cd pokedex
   ```

3. Install the NPM packages

   ```sh
   npm i
   ```

4. Start the development server

   ```sh
   npm start
   ```

5. Development server will start at `localhost:8080`

<br/>

## Linting

This project is configured with [ESLint](https://eslint.org/) for linting in `.eslintrc.json`. You can use `npm run lint` script to check for errors or warnings in the project.
<br/>

## Formatting

This project uses [Prettier](https://prettier.io/) for formatting. You can use `npm run prettify` script to format all files in the project.

## Bundling

This project uses [webpack](https://webpack.js.org/) for bundling.

- Use `npm run build` script to generate a production build
- Use `npm run build:dev` script to generate a development build.
- Build will output to `dist` folder.

## Babel

This project is configured with new [runtime JSX transform](https://reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html). React doesn't need to be in scope while using JSX.

## Demo

Live Demo - https://pokedex.shanpriyan.in/
