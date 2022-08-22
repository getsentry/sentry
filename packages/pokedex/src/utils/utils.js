export const TYPE_COLOR = {
  normal: "#A8A878",
  water: "#6890F0",
  ice: "#86D1F3",
  grass: "#78c850",
  fire: "#F08030",
  dragon: "#7038F8",
  electric: "#F8D030",
  bug: "#A8B820",
  fairy: "#EE99AC",
  ground: "#E0C068",
  rock: "#B8A038",
  steel: "#42BD94",
  poison: "#A040A0",
  ghost: "#705898",
  dark: "#5A5979",
  flying: "#4A677D",
  fighting: "#994025",
  psychic: "#F85888",
};

export const hexToRGBA = (hex, a = 0.2) => {
  if (!hex) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r},${g},${b},${a})`;
};

export const COLOR = {
  TYPE: (type) => TYPE_COLOR[type],
  LINEAR_GRAD: (type = "normal", opacity = 0.6) =>
    `linear-gradient(${hexToRGBA(TYPE_COLOR[type], opacity)},#fff)`,
  RGBA: (type = "normal", opacity = 0.6) =>
    hexToRGBA(TYPE_COLOR[type], opacity),
};

export const capitalize = (str = "") => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const findEngLang = (arr) =>
  arr.find(({ language }) => language.name === "en");

export const getPokemonBio = (pokemonData, speciesData) => {
  const en = findEngLang(speciesData.flavor_text_entries);

  const types = pokemonData.types.reduce((acc, { type }, i) => {
    const typeInCaps = capitalize(type.name);
    if (!acc) return typeInCaps;
    if (i === pokemonData.types.length - 1) {
      return `${acc} and ${typeInCaps}`;
    }
    return `${acc}, ${typeInCaps}`;
  }, "");

  const legendary = speciesData.is_legendary ? " legendary, " : "";
  const mythical = speciesData.is_mythical ? " mythical, " : "";
  return `${capitalize(
    pokemonData.name
  )}, ${legendary}${mythical}${types} type pokemon. ${en.flavor_text.replace(
    /\n|\f/g,
    " "
  )}`;
};

export const documentTitle = {
  value: "Pokédex",
  set(nameTobeAppended) {
    document.title = [this.value, capitalize(nameTobeAppended)]
      .filter(Boolean)
      .join(" | ");
  },
  reset() {
    document.title = this.value;
  },
};

export const formatId = (id) => {
  if (id < 10) return `00${id}`;
  if (id < 100) return `0${id}`;
  return id;
};

export const formatTypes = (types) =>
  ` ${types.reduce((acc, { type }) => {
    const upperCasedType = type.name.toUpperCase();
    if (!acc) return upperCasedType;
    return `${acc} ${upperCasedType}`;
  }, "")}`;

export const formatStatsTitle = (str) => {
  const [first, second] = str.split("-");
  const firstCap = first === "hp" ? "HP" : capitalize(first);
  return [firstCap, capitalize(second)].filter(Boolean).join(" ");
};

export const formatKebabCase = (str, joinWith = " ") =>
  str
    .split("-")
    .map((text) => capitalize(text))
    .join(joinWith);

export const formatGeneration = (str) =>
  str
    .split("-")
    .map((text, i) => (!i ? capitalize(text) : text.toUpperCase()))
    .join(" ");

export const getPokemonImage = (pokemonData) => {
  const image =
    pokemonData.sprites.other.dream_world.front_default ||
    pokemonData.sprites.front_default;
  return image;
};

export const scrollToTop = (enableSmoothScroll) =>
  window.scrollTo({
    top: 0,
    behavior: enableSmoothScroll ? "smooth" : "auto",
  });
