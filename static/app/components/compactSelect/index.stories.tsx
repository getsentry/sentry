import {Fragment, useState} from 'react';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(CompactSelect, story => {
  story('Simple', () => {
    const [value, setValue] = useState<string>('');
    const options = [
      {value: '', label: 'All'},
      {value: '2', label: '2XX'},
      {value: '3', label: '3XX'},
      {value: '4', label: '4XX'},
      {value: '5', label: '5XX'},
    ];

    const handleValueChange = newValue => {
      setValue(newValue.value);
    };

    return (
      <Fragment>
        <p>
          <code>CompactSelect</code> is a general-purpose dropdown selector component. In
          the most basic case, a <code>value</code>, <code>onChange</code> handler and an
          array of <code>options</code> are all that's needed. The component does not
          maintain its own selection state.
        </p>

        <p>
          <b>NOTE:</b> Prefer using this component over <code>SelectControl</code>!
        </p>

        <CompactSelect value={value} onChange={handleValueChange} options={options} />
      </Fragment>
    );
  });

  story('Complicated', () => {
    const [values, setValues] = useState<string[]>(['Bo Peep', 'M-O']);
    const toyStory = ['Woody', 'Buzz', 'Sid', 'Bo Peep', 'Stinky Pete', 'Rex', 'Hamm'];

    const wallE = ['WALL-E', 'EVE', 'AUTO', 'Cpt. McCrea', 'M-O'];

    const options = [
      {
        key: 'toy-story',
        label: 'Toy Story',
        options: arrayToOptions(toyStory),
      },
      {
        key: 'wall-e',
        label: 'WALL-E',
        options: arrayToOptions(wallE),
      },
    ];

    const handleValueChange = newValues => {
      setValues(newValues.map(value => value.value));
    };

    return (
      <Fragment>
        <p>
          <code>CompactSelect</code> can also be made searchable, clearable,
          multi-selectable, etc. It's also possible to group items into sections, and set
          the props for the trigger.
        </p>

        <CompactSelect
          triggerProps={{
            prefix: t('Character'),
          }}
          value={values}
          onChange={handleValueChange}
          options={options}
          multiple
          searchable
          clearable
        />
      </Fragment>
    );
  });
});

const arrayToOptions = (array: string[]) =>
  array.map(item => ({
    value: item,
    label: item,
  }));
