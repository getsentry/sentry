import SimpleTableChart from 'sentry/components/charts/simpleTableChart';

export default {
  title: 'Components/Data Visualization/Charts/Simple Table Chart',
  component: SimpleTableChart,
  args: {
    title: '',
  },
};

export const _SimpleTableChart = ({title}) => {
  const organization = {slug: 'org-slug'};
  const fields = ['title', 'count()'];
  const metadata = {count: 'string', title: 'string'};
  const data = [
    {title: 'An error', count: 100},
    {title: 'An longer title that goes on a bit', count: 1000},
  ];
  return (
    <div className="section">
      <h2>Loading State</h2>
      <SimpleTableChart
        organization={organization}
        fields={fields}
        title={title}
        metadata={undefined}
        data={[]}
        loading
      />
      <h2>Filled State</h2>
      <SimpleTableChart
        organization={organization}
        fields={fields}
        title={title}
        metadata={metadata}
        data={data}
      />
    </div>
  );
};
_SimpleTableChart.parameters = {
  docs: {
    description: {
      story: 'A borderless table that can be used in charts/dashboards',
    },
  },
};
