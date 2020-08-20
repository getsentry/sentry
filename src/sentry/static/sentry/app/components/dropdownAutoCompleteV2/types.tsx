// export type ItemWithoutSubItems = ItemBase & {
//   // this is necessary only to make the compiler happy :(
//   items?: undefined;
// };

// export type ItemWithSubItems = ItemBase & {
//   items: Array<ItemWithoutSubItems>;
//   hideGroupLabel?: boolean;
// };

export type Item = {
  // this should be unique
  value: string;
  label:
    | (({inputValue}: {inputValue: string}) => React.ReactElement)
    | React.ReactElement;
  searchKey?: string;
  items?: Array<Omit<Item, 'items'>>;
  hideGroupLabel?: boolean;
};

export type ItemSize = 'zero' | 'small';
