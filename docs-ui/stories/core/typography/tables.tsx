import styled from '@emotion/styled';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from 'docs-ui/components/table';

type TypeStyle = {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number;
  letterSpacing?: string;
  lineHeight?: number;
};

type TypeDefinition = {
  name: string;
  style: TypeStyle;
  /**
   * HTML tag (h1, h2, p) used to render type element
   */
  tag: keyof JSX.IntrinsicElements;
};

type Column = {
  align: 'left' | 'right' | 'center';
  colName: string;
  tabularFigures: boolean;
  key?: keyof TypeStyle | keyof TypeDefinition;
};

const sampleColumn: Column = {
  colName: 'Scale',
  key: 'name',
  align: 'left',
  tabularFigures: false,
};

const styleColumns: Column[] = [
  {
    colName: 'Weight',
    key: 'fontWeight',
    align: 'right',
    tabularFigures: true,
  },
  {
    colName: 'Size',
    key: 'fontSize',
    align: 'right',
    tabularFigures: true,
  },
  {
    colName: 'Line height',
    key: 'lineHeight',
    align: 'right',
    tabularFigures: true,
  },
  {
    colName: 'Letter spacing',
    key: 'letterSpacing',
    align: 'right',
    tabularFigures: true,
  },
];

const scaleDefinitions: TypeDefinition[] = [
  {
    name: 'Heading 1',
    tag: 'h1',
    style: {
      fontWeight: 600,
      fontSize: '2.25rem',
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
  },
  {
    name: 'Heading 2',
    tag: 'h2',
    style: {
      fontWeight: 600,
      fontSize: '1.875rem',
      lineHeight: 1.2,
      letterSpacing: '-0.016em',
    },
  },
  {
    name: 'Heading 3',
    tag: 'h3',
    style: {
      fontWeight: 600,
      fontSize: '1.625rem',
      lineHeight: 1.2,
      letterSpacing: '-0.012em',
    },
  },
  {
    name: 'Heading 4',
    tag: 'h4',
    style: {
      fontWeight: 600,
      fontSize: '1.375rem',
      lineHeight: 1.2,
      letterSpacing: '-0.008em',
    },
  },
  {
    name: 'Heading 5',
    tag: 'h5',
    style: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.2,
      letterSpacing: '-0.004em',
    },
  },
  {
    name: 'Heading 6',
    tag: 'h6',
    style: {
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.2,
      letterSpacing: 'normal',
    },
  },
  {
    name: 'Paragraph',
    tag: 'p',
    style: {
      fontWeight: 400,
      fontSize: '1rem',
      lineHeight: 1.4,
      letterSpacing: 'normal',
    },
  },
  {
    name: 'Button/Label',
    tag: 'p',
    style: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.2,
      letterSpacing: 'normal',
    },
  },
  {
    name: 'Small',
    tag: 'p',
    style: {
      fontWeight: 400,
      fontSize: '0.875rem',
      lineHeight: 1.4,
      letterSpacing: '+0.01rem',
    },
  },
];

/**
 * Generic component with variable HTML tag name,
 * to be used with @emotion's as prop.
 * See: https://emotion.sh/docs/styled#as-prop
 */
const TypeComponent = styled('div')``;

const generateTypeTable =
  (cols: {sampleColumn: Column; styleColumns: Column[]}, definitions: TypeDefinition[]) =>
  () =>
    (
      <Table>
        <TableHead>
          <TableRow>
            {[sampleColumn, ...styleColumns].map(col => (
              <TableHeadCell
                key={col.key}
                align={col.align}
                tabularFigures={col.tabularFigures}
              >
                {col.colName}
              </TableHeadCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {definitions.map(scale => (
            <TableRow key={scale.name}>
              <TableCell
                key={cols.sampleColumn.key}
                align={cols.sampleColumn.align}
                tabularFigures={cols.sampleColumn.tabularFigures}
                morePadding
              >
                <TypeComponent as={scale.tag} style={scale.style}>
                  {scale[cols.sampleColumn.key!]}
                </TypeComponent>
              </TableCell>
              {cols.styleColumns.map(col => (
                <TableCell
                  key={col.key}
                  align={col.align}
                  tabularFigures={col.tabularFigures}
                  morePadding
                >
                  {scale.style?.[col.key!]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

export const ScaleTable = generateTypeTable(
  {sampleColumn, styleColumns},
  scaleDefinitions
);

const tabularFiguresColumns: Column[] = [
  {
    colName: 'Proportional figures',
    align: 'right',
    tabularFigures: false,
  },
  {
    colName: 'Tabular figures',
    align: 'right',
    tabularFigures: true,
  },
];

const tabularFiguresSamples: string[] = ['999,999', '111,111', '9.99999', '1.11111'];

export const TabularFigureTable = () => (
  <Table>
    <TableHead>
      <TableRow>
        {tabularFiguresColumns.map(col => (
          <TableHeadCell
            key={col.colName}
            align={col.align}
            tabularFigures={col.tabularFigures}
          >
            {col.colName}
          </TableHeadCell>
        ))}
      </TableRow>
    </TableHead>
    <TableBody>
      {tabularFiguresSamples.map(sample => (
        <TableRow key={sample}>
          {tabularFiguresColumns.map(col => (
            <TableCell
              key={col.colName}
              align={col.align}
              tabularFigures={col.tabularFigures}
            >
              {sample}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
