import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {getMeta} from 'app/components/events/meta/metaProxy';

type Props = {
  data: Record<string, any>;
};

function CSPContent({data}: Props) {
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

export default CSPContent;
