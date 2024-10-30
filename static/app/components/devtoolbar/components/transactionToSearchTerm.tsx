export default function transactionToSearchTerm(transaction) {
  // finds dynamic parts of transaction name to change into search term
  let modifiedTransaction = transaction;

  // ([:]([^\/]*)) matches :param used by React, Vue, Angular, Express, Ruby on Rails, Phoenix, Solid
  // ([\[]([^\/]*)[\]]) matches [param] used by Next.js, Nuxt.js, Svelte
  // ([{]([^\/]*)[}]) matches {param} used by ASP.NET Core, Laravel, Symfony
  // ([<]([^\/]*)[>]) matches <param> used by Flask, Django
  const parameterizedRegex =
    /([\/])(([:]([^\/]*))|([\[]([^\/]*)[\]])|([{]([^\/]*)[}])|([<]([^\/]*)[>]))/g;
  modifiedTransaction = modifiedTransaction.replaceAll(parameterizedRegex, '/*');

  // transaction name could contain the resolved URL instead of the route pattern (ie actual id instead of :id)
  // match any param that starts with a number eg. /12353
  const nonparameterizedRegex = /([\/])([0-9]+)/g;
  modifiedTransaction = modifiedTransaction.replaceAll(nonparameterizedRegex, '/*');

  // Join the array back into a string with '/'
  const searchTerm = `/${modifiedTransaction}/`.replaceAll(/\/+/g, '/');
  return searchTerm;
}
