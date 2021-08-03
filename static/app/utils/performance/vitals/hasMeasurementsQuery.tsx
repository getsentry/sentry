import omit from 'lodash/omit';
import pick from 'lodash/pick';

import {Client} from 'app/api';
import {escapeDoubleQuotes} from 'app/utils';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import {escapeTagValue} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';

type HasMeasurementsProps = {
  transaction: string;
  type: 'web' | 'mobile';
};

type RequestProps = DiscoverQueryProps & HasMeasurementsProps;

type HasMeasurements = {measurements: boolean};

type ChildrenProps = Omit<GenericChildrenProps<HasMeasurementsProps>, 'tableData'> & {
  hasMeasurements: boolean | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getHasMeasurementsRequestPayload(props: RequestProps) {
  const {eventView, location, transaction, type} = props;
  const escaped = escapeDoubleQuotes(escapeTagValue(transaction));
  const baseApiPayload = {
    transaction: `"${escaped}"`,
    type,
  };
  const additionalApiPayload = pick(eventView.getEventsAPIPayload(location), [
    'project',
    'environment',
  ]);
  return Object.assign(baseApiPayload, additionalApiPayload);
}

function beforeFetch(api: Client) {
  api.clear();
}

function HasMeasurementsQuery(props: Props) {
  return (
    <GenericDiscoverQuery<HasMeasurements, HasMeasurementsProps>
      route="events-has-measurements"
      getRequestPayload={getHasMeasurementsRequestPayload}
      beforeFetch={beforeFetch}
      {...omit(props, 'children')}
    >
      {({tableData, ...rest}) => {
        return props.children({
          hasMeasurements: tableData?.measurements ?? null,
          ...rest,
        });
      }}
    </GenericDiscoverQuery>
  );
}

export default withApi(HasMeasurementsQuery);
