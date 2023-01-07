const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.restaurants = async (event, context) => {
  // Insert restaurant
  if (event.httpMethod === "POST") {
    const restaurant = JSON.parse(event.body);
    const params = {
      TableName: "Restaurants",
      Item: restaurant,
    };
    try {
      await dynamodb.put(params).promise();
      return {
        statusCode: 201,
        body: JSON.stringify(restaurant),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Could not save restaurant" }),
      };
    }
  }
  // Get all restaurants
  else if (event.httpMethod === "GET") {
    try {
      const params = {
        TableName: "Restaurants",
      };
      const result = await dynamodb.scan(params).promise();
      return {
        statusCode: 200,
        body: JSON.stringify(result.Items),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Could not retrieve restaurants" }),
      };
    }
  }
};
