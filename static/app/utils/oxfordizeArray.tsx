import {Children, Fragment} from 'react';

// Given a list of strings (probably nouns), join them into a single string
// with correct punctuation and 'and' placement
//
// for example: ['A'] --> 'A'
//              ['A', 'B'] --> 'A and B'
//              ['A', 'B', 'C'] --> 'A, B, and C'
const oxfordizeArray = (strings: string[]) =>
  strings.length <= 2
    ? strings.join(' and ')
    : [strings.slice(0, -1).join(', '), strings.slice(-1)[0]].join(', and ');

type Props = {
  children: React.ReactNode;
};
export function Oxfordize({children}: Props) {
  const elements = Children.toArray(children);
  if (elements.length === 1) {
    return <span>{elements[0]}</span>;
  }
  if (elements.length === 2) {
    return (
      <span>
        {elements[0]} and {elements[1]}
      </span>
    );
  }

  const joinedElements: JSX.Element[] = [];
  for (const [i, element] of elements.slice(0, -1).entries()) {
    joinedElements.push(<Fragment key={i}>{element}, </Fragment>);
  }
  joinedElements.push(
    <Fragment key={elements.length - 1}>and {elements[elements.length - 1]}</Fragment>
  );
  return <span>{joinedElements}</span>;
}

export default oxfordizeArray;
