import {createContext, useContext} from 'react';

// Safari doesn't submit a form when the button has an explicit `form` attribute
// pointing at its own parent form. Only set the attribute when the button is
// rendered outside the <form> element.
const FormElementContext = createContext(false);
const useIsInsideFormElement = () => useContext(FormElementContext);

export {FormElementContext, useIsInsideFormElement};
