import React, {useCallback, useEffect, useState} from 'react';
import { EditorMode } from '../../../../types/types';
import { Button, InlineField, InlineFieldRow, InlineLabel, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

export const QueryBuilder = ({ query, onRunQuery, onChange, datasource, setEditorMode }: any) => {
  const [databases, setDatabases] = useState([]);
  const [tables, setTables] = useState([]);
  const [dateColumns, setdateColumns] = useState([]);
  const [timestampColumns, setTimestampColumns] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>(query.database);
  const [selectedTable, setSelectedTable] = useState<string>(query.table);
  const [selectedColumnTimestampType, setSelectedColumnTimestampType] = useState(query.dateTimeColDataType);
  const [selectedColumnDateType, setSelectedColumnDateType] = useState(query.dateColDataType);
  const [selectedDateTimeType, setSelectedDateTimeType] = useState(query.dateTimeType);

  const buildExploreQuery = useCallback((type) => {
    let query;
    switch (type) {
      case 'TABLES':
        query = 'SELECT name ' +
          'FROM system.tables ' +
          'WHERE database = \'' + selectedDatabase + '\' ' +
          'ORDER BY name';
        break;
      case 'DATE':
        query = 'SELECT name ' +
          'FROM system.columns ' +
          'WHERE database = \'' + selectedDatabase + '\' AND ' +
          'table = \'' + selectedTable + '\' AND ' +
          'match(type,\'^Date$|^Date\\([^)]+\\)$\') ' +
          'ORDER BY name ' +
          'UNION ALL SELECT \' \' AS name';
        break;
      case 'DATETIME':
        query = 'SELECT name ' +
          'FROM system.columns ' +
          'WHERE database = \'' + selectedDatabase + '\' AND ' +
          'table = \'' + selectedTable + '\' AND ' +
          'match(type,\'^DateTime$|^DateTime\\([^)]+\\)$\') ' +
          'ORDER BY name';
        break;
      case 'DATETIME64':
        query = 'SELECT name ' +
          'FROM system.columns ' +
          'WHERE database = \'' + selectedDatabase + '\' AND ' +
          'table = \'' + selectedTable + '\' AND ' +
          'type LIKE \'DateTime64%\' ' +
          'ORDER BY name';
        break;
      case 'TIMESTAMP':
        query = 'SELECT name ' +
          'FROM system.columns ' +
          'WHERE database = \'' + selectedDatabase + '\' AND ' +
          'table = \'' + selectedTable + '\' AND ' +
          'type = \'UInt32\' ' +
          'ORDER BY name';
        break;
      case 'DATABASES':
        query = 'SELECT name ' +
          'FROM system.databases ' +
          'ORDER BY name';
        break;
      case 'COLUMNS':
        query = 'SELECT name text, type value ' +
          'FROM system.columns ' +
          'WHERE database = \'' + selectedDatabase + '\' AND ' +
          'table = \'' + selectedTable + '\'';
        break;
    }
    return query;
  },[selectedTable, selectedDatabase])

  const querySegment = useCallback((type: any) => {
    let query = buildExploreQuery(type);
    return datasource.metricFindQuery(query)
    // .then(this.uiSegmentSrv.transformToSegments(false))
    // .catch(this.handleQueryError.bind(this));
  },[buildExploreQuery, datasource])

  useEffect(() => {
    (async () => {
      const databases = await querySegment('DATABASES')
      setDatabases(databases.map((item: any) => ({ label: item.text, value: item.text })))
    })()
  }, [querySegment]);

  useEffect(() => {
    if (selectedDatabase) {
      (async () => {
        const tables = await querySegment('TABLES')
        setTables(tables.map((item: any) => ({ label: item.text, value: item.text })))
      })()
    }
  }, [selectedDatabase, querySegment]);

  useEffect(() => {
    if (!!selectedDatabase || !!selectedTable || !!selectedDateTimeType) {
      (async () => {
        const timestampColumns = await querySegment(selectedDateTimeType)
        setTimestampColumns(timestampColumns.map((item: any) => ({ label: item.text, value: item.text })))
      })()
    }
  }, [selectedTable, selectedDatabase, selectedDateTimeType, querySegment]);

  useEffect(() => {
    if (!!selectedDatabase || !!selectedTable) {

      (async () => {
        const dateColumns = await querySegment('DATE')
        setdateColumns(dateColumns.map((item: any) => ({ label: item.text, value: item.text })))
      })()
    }
  }, [selectedTable, selectedDatabase, querySegment]);

  const onDateTimeTypeChanged = (dateTimeType: SelectableValue) => {
    setSelectedDateTimeType(dateTimeType.value);
    query.dateTimeType = dateTimeType.value;
    onChange(query);
  };
  const switchToSQLMode = () => {
    setEditorMode(EditorMode.SQL)
  };

  const onDatabaseChange = (database: string) => {
    setSelectedDatabase(database);
    query.database = database;
    onChange(query);
  };

  const onTableChange = (table: string) => {
    setSelectedTable(table);
    query.table = table;
    onChange(query);
  };

  const onDateColDataTypeChange = (dateColDataType: string) => {
    // @ts-ignore
    setSelectedColumnDateType(dateColDataType.trim());
    query.dateColDataType = dateColDataType;
    onChange(query);
  };

  const onDateTimeColDataTypeChange = (dateTimeColDataType: string) => {
    // @ts-ignore
    setSelectedColumnTimestampType(dateTimeColDataType.trim());
    query.dateTimeColDataType = dateTimeColDataType;
    onChange(query);
  };

  return (
    <div className="gf-form" style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
      <InlineFieldRow>
        <InlineField
          label={
            <InlineLabel width={24} >
              <span style={{ color: '#6e9fff' }}>FROM</span>
            </InlineLabel>
          }
        >
          <Select
            width={24}
            onChange={(item: SelectableValue<string>) => onDatabaseChange(item.value as unknown as string)}
            placeholder={'Database'}
            options={databases}
            value={selectedDatabase}
          />
        </InlineField>
        <InlineField >
          <Select
            width={24}
            // @ts-ignore
            onChange={({ value }: { value: SelectableValue<string> }) => onTableChange(value)}
            placeholder={'Table'}
            options={tables}
            disabled={true}
            value={selectedTable as unknown as SelectableValue<string>}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={
            <InlineLabel
              width={24}
              tooltip={
                <div style={{ width: '200px', backgroundColor: 'black' }}>
                  Select Type &nbsp;
                  <a
                    href="https://clickhouse.com/docs/en/sql-reference/data-types/datetime/"
                    rel="noreferrer"
                    target="_blank"
                  >
                    DateTime
                  </a>
                  ,&nbsp;
                  <a
                    href="https://clickhouse.com/docs/en/sql-reference/data-types/datetime64/"
                    rel="noreferrer"
                    target="_blank"
                  >
                    DateTime64
                  </a>
                  &nbsp; or{' '}
                  <a
                    href="https://clickhouse.com/docs/en/sql-reference/data-types/int-uint/"
                    rel="noreferrer"
                    target="_blank"
                  >
                    UInt32
                  </a>{' '}
                  column for binding with Grafana range selector
                </div>
              }
              
            >
              Column timestamp type
            </InlineLabel>
          }
          
        >
          <Select
            width={24}
            onChange={onDateTimeTypeChanged}
            placeholder={'Timestamp type'}
            options={[
              { label: 'DateTime', value: 'DATETIME' },
              { label: 'DateTime64', value: 'DATETIME64' },
              { label: 'TimeStamp', value: 'TIMESTAMP' },
            ]}
            value={selectedDateTimeType}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={
            <InlineLabel width={24} >
              Timestamp Column
            </InlineLabel>
          }
          
        >
          <Select width={24} value={selectedColumnTimestampType} onChange={({value}) => onDateTimeColDataTypeChange(value as string)} placeholder={'Timestamp column'} options={timestampColumns} disabled={!timestampColumns.length}/>
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={
            <InlineLabel
              width={24}
              tooltip={
                <div style={{ width: '200px', backgroundColor: 'black' }}>
                  Select
                  <a
                    rel="noreferrer"
                    href="https://clickhouse.tech/docs/en/sql-reference/data-types/date/"
                    target="_blank"
                  >
                    Date
                  </a>
                  column for binding with Grafana range selector
                </div>
              }
              
            >
              Date column
            </InlineLabel>
          }
          
        >
          <Select width={24} value={selectedColumnDateType} onChange={({value}) => onDateColDataTypeChange(value as string)} placeholder={'Date Column'} options={dateColumns} disabled={true} />
        </InlineField>
      </InlineFieldRow>
      <Button variant="primary" icon="arrow-right" onClick={switchToSQLMode} >
        Go to Query
      </Button>
    </div>
  );
};

export default QueryBuilder;