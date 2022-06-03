import {useEffect} from 'react';

import AutoComplete from 'sentry/components/autoComplete';

const exampleItems = [
  {
    name: 'Apple',
  },
  {
    name: 'Pineapple',
  },
  {
    name: 'Orange',
  },
];

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  title: 'Components/Forms/Auto Complete',
  parameters: {
    controls: {hideNoControlsWarning: true},
  },
};

const MenuRoot = ({registerItemCount, items, ...props}) => {
  useEffect(() => registerItemCount(items.length), [registerItemCount, items.length]);

  return <div {...props} />;
};

const Item = ({item, index, registerVisibleItem, ...props}) => {
  useEffect(() => registerVisibleItem(index, item), [registerVisibleItem, index, item]);

  return <div {...props}>{item.name}</div>;
};

export const InputSimple = () => (
  <AutoComplete itemToString={item => item.name}>
    {({
      getRootProps,
      getInputProps,
      getMenuProps,
      getItemProps,
      inputValue,
      highlightedIndex,
      isOpen,
      registerVisibleItem,
      registerItemCount,
    }) => {
      return (
        <div {...getRootProps({style: {position: 'relative'}})}>
          <input {...getInputProps({})} />

          {isOpen && (
            <div
              {...getMenuProps({
                style: {
                  boxShadow:
                    '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',
                  position: 'absolute',
                  backgroundColor: 'white',
                  padding: '0',
                },
              })}
            >
              <MenuRoot items={exampleItems} registerItemCount={registerItemCount}>
                {exampleItems
                  .filter(
                    item => item.name.toLowerCase().indexOf(inputValue.toLowerCase()) > -1
                  )
                  .map((item, index) => (
                    <Item
                      key={item.name}
                      item={item}
                      index={index}
                      registerVisibleItem={registerVisibleItem}
                      {...getItemProps({
                        item,
                        index,
                        style: {
                          cursor: 'pointer',
                          padding: '6px 12px',
                          backgroundColor:
                            index === highlightedIndex
                              ? 'rgba(0, 0, 0, 0.02)'
                              : undefined,
                        },
                      })}
                    />
                  ))}
              </MenuRoot>
            </div>
          )}
        </div>
      );
    }}
  </AutoComplete>
);

InputSimple.parameters = {
  docs: {
    description: {
      story: 'Simple AutoComplete on an input',
    },
  },
};
