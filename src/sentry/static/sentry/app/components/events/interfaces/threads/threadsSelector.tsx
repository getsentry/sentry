/* eslint-disable react/prop-types */
import React from 'react';
import ReactSelect, {ValueType} from 'react-select';

import {Event} from 'app/types';

import ThreadsSelectorOption from './threadsSelectorOption';
import {Thread} from './getThreadDetails';
import threadSelectoStyles from './thread-selector-styles';
import ThreadsSelectorSingleValue from './threadsSelectorSingleValue';

interface Props {
  className?: string;
  threads: Array<Thread>;
  event: Event;
  onChange?: (thread: Thread) => void;
}

const ThreadsSelector: React.FC<Props> = ({className, event, threads, onChange}) => {
  const handleOnChange = (value: ValueType<Thread>) => {
    if (onChange) {
      // TODO(ts): Do some research about ValueType. For instance here: https://github.com/JedWatson/react-select/issues/2902
      const selecteOption = value as Thread;
      onChange(selecteOption);
    }
  };

  return (
    <ReactSelect
      defaultValue={threads[0]}
      className={className}
      styles={threadSelectoStyles}
      onChange={handleOnChange}
      options={threads.map(thread => ({
        ...thread,
        value: thread.id,
      }))}
      formatOptionLabel={({id, name, crashed, stacktrace}) => (
        <ThreadsSelectorOption thread={{id, name, crashed, stacktrace}} event={event} />
      )}
      components={{
        SingleValue: ({data: {id, name, crashed, stacktrace}}) => (
          <ThreadsSelectorSingleValue thread={{id, name, crashed, stacktrace}} />
        ),
      }}
      menuIsOpen
      isSearchable
    />
  );
};

export default ThreadsSelector;
