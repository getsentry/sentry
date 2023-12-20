import TextareaAutosize from 'react-autosize-textarea';

const SearchBoxTextArea = TextareaAutosize;

/**
 * Returns TextareaAutosize in prod, but is mocked with 'textarea' for unit tests.
 */
export default SearchBoxTextArea;
