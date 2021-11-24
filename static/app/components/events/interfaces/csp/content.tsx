import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {getMeta} from 'sentry/components/events/meta/metaProxy';

type Props = {
  data: Record<string, any>;
};

function Content({data}: Props) {
  return (
    <div>
      <h4>
        <span>{data.effective_directive}</span>
      </h4>
      <KeyValueList
        data={Object.entries(data).map(([key, value]) => ({
          key,
          subject: key,
          value,
          meta: getMeta(data, key),
        }))}
        isContextData
      />
    </div>
  );
}

export default Content;
