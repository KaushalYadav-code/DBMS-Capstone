# DepGraph Architecture and Data Model Diagrams

These diagrams were checked against the Express route registration in server/src/app.js, the collection access in server/src/db.js and server/src/routes, and the client code in index.html.

## System architecture

~~~mermaid
flowchart LR
    U[User] --> B[Browser]
    B --> I[index.html<br/>HTML CSS vanilla JavaScript SVG]
    I -->|fetch JSON over HTTP| E[Express application<br/>127.0.0.1:3000]
    E --> H[Input validation and API routes]
    H --> R[Projects Packages Dependencies Vulnerabilities Dashboard Graph]
    R --> D[MongoDB Node.js driver]
    D --> M[(MongoDB database<br/>depgraph)]
    M --> C[(projects)]
    M --> P[(packages)]
    M --> L[(dependencies)]
    M --> V[(vulnerabilities)]
    C --> D
    P --> D
    L --> D
    V --> D
~~~

The browser does not connect to MongoDB. The Express process reads environment configuration, connects through the MongoDB Node.js driver, applies the existing migration/index setup, and exposes the API. The server binds to loopback in this local capstone configuration.

## Collection relationships

~~~mermaid
erDiagram
    PROJECTS ||--o{ DEPENDENCIES : contains
    PACKAGES ||--o{ DEPENDENCIES : target
    PACKAGES o|--o{ DEPENDENCIES : source
    PACKAGES ||--o{ VULNERABILITIES : has_notes

    PROJECTS {
        ObjectId _id
        string name
        string nameKey
        string ecosystem
        string description
        string owner
        string repository
        date createdAt
        date updatedAt
    }
    PACKAGES {
        ObjectId _id
        string name
        string version
        string ecosystem
        string license
        string comparisonVersion
        string description
        date createdAt
        date updatedAt
    }
    DEPENDENCIES {
        ObjectId _id
        ObjectId projectId
        ObjectId sourcePackageId
        ObjectId targetPackageId
        string dependencyType
        string versionConstraint
        string reviewStatus
        date createdAt
        date updatedAt
    }
    VULNERABILITIES {
        ObjectId _id
        ObjectId packageId
        string identifier
        string severity
        string affectedVersions
        string recommendedAction
        string status
        string verificationStatus
        string sourceUrl
        date createdAt
        date updatedAt
    }
~~~

The sourcePackageId field is nullable. A null source represents the project root, so a direct project-to-package edge is still stored as a dependency document. Package documents are global and can participate in dependency records for more than one project. Vulnerability notes reference a package document; matching then checks candidate packages with the same ecosystem and name.

Unique indexes protect normalized project names, package identity (name, version, ecosystem), dependency edges (project, source, target), and vulnerability identifiers. Additional indexes support common filters and lookups.

## Creating and displaying a dependency edge

~~~mermaid
sequenceDiagram
    actor User
    participant UI as index.html
    participant API as Express dependency route
    participant DB as MongoDB

    User->>UI: Choose project, source and target package
    UI->>API: POST /api/dependencies with relationship fields
    API->>API: Validate required fields, ObjectIds and relationship type
    API->>DB: Confirm project and package records exist
    API->>DB: Confirm transitive source belongs to selected project
    API->>DB: Insert dependency document
    DB-->>API: Stored document and generated ObjectId
    API-->>UI: 201 response with the saved relationship
    UI->>API: GET /api/graph?projectId=...
    API->>DB: Read project links, referenced packages and notes
    DB-->>API: Current stored records
    API-->>UI: Graph nodes, directed edges and optional selection
    UI->>UI: Draw SVG graph and refresh tables/metrics
~~~

The graph endpoint maps null sourcePackageId to a synthetic project-root node and package IDs to package nodes. It emits an edge only when the referenced target and any non-null source package are present. Selecting a package returns its immediate outgoing package links, incoming package dependents, project-root memberships, and matched notes. The frontend arranges nodes by graph depth and tracks visited nodes so cycles terminate during layout. Cyclic dependencies are not rejected by the API; self-dependency is rejected.

