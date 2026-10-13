import {emptyValue, emptyStringValue} from './emptyFieldValues';

export function nullableValue(value: string | null): string | React.ReactElement {
  switch (value) {
    case null:
      return emptyValue;
    case '':
      return emptyStringValue;
    default:
      return value;
  }
}
