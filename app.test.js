const request = require("supertest");
const { app, startServer } = require("./app");

describe("GET /home", () => {
  it("should return h1 with Testing", async () => {
    const response = await request(app).get("/home");
    expect(response.status).toBe(200);
    expect(response.text).toBe("<h1>Testing</h1>");
  });

  it("should return HTML content type", async () => {
    const response = await request(app).get("/home");
    expect(response.headers["content-type"]).toMatch(/html/);
  });
});

describe("startServer function", () => {
  let server;

  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it("should start server on default port 3000", (done) => {
    server = startServer();
    expect(server).toBeDefined();
    expect(server.listening).toBe(true);
    done();
  });

  it("should start server on custom port", (done) => {
    server = startServer(4000);
    expect(server).toBeDefined();
    expect(server.listening).toBe(true);
    done();
  });
});

describe("Error handling", () => {
  it("should return 404 for non-existent routes", async () => {
    const response = await request(app).get("/nonexistent");
    expect(response.status).toBe(404);
  });
});
