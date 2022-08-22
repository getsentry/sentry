from neo4j import GraphDatabase

uri = "neo4j://127.0.0.1:7687"
neo4j_driver = GraphDatabase.driver(uri)
