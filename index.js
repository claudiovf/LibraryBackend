const { ApolloServer, gql, UserInputError, AuthenticationError } = require('apollo-server')
const mongoose = require('mongoose')
const Author = require('./models/author')
const Book = require('./models/book')
const User = require('./models/user')
const jwt = require('jsonwebtoken')

const JWT_SECRET = 'britt'

const MONGODB_URI = 'mongodb+srv://fullstack:fullstack@cluster0.vesim.mongodb.net/LibraryDB?retryWrites=true&w=majority'

console.log('connecting to ', MONGODB_URI)

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true

})
    .then(() => {
        console.log('connected to MongoDB')
    })
    .catch(error => {
        console.log('error connecting to MongoDB: ', error.message)
    })


const typeDefs = gql`


    type Author {
        name: String!
        born: Int
        bookCount: Int!
        id: ID!
    }

    type Book {
        title: String!
        published: Int!
        author: Author!
        genres: [String!]!
        id: ID!
    }

    type User {
        username: String!
        favoriteGenre: String!
        id: ID!
    }

    type Token {
        value: String!
    }

    type Query {
        bookCount: Int!
        authorCount: Int!
        allBooks(
            author: String 
            genre: String
        ): [Book!]!
        allAuthors: [Author!]!
        allUsers: [User!]!
        me: User
    }

    type Mutation {
        addBook(
            title: String!
            author: String!
            published: Int!
            genres: [String!]!
        ): Book

        editAuthor(
            name: String!
            setBornTo: Int!
        ): Author

        createUser(
            username: String!
            favoriteGenre: String!
        ): User

        login(
            username: String!
            password: String!
        ): Token

        deleteBooks: [String]

        deleteAuthors: [String]
    }


`

const resolvers = {
  Query: {
      bookCount: () => Book.collection.countDocuments(),
      authorCount: () => Author.collection.countDocuments(),
      allBooks: async (root, args) => {

          if(args.genre) {
              return await Book.find({ genres: args.genre  }).populate('author')
          }

          return Book.find({}).populate('author')
      },
      allAuthors: async () => {
          const authors = await Author.find({})
 
          return authors
      },
      allUsers: async () => {
          const users = await User.find({})

          return users
      },
      me: async (root, args, {currentUser}) => {
          return currentUser
      }
      
  },                                                         
  Author: {
      bookCount: async (root) => {
            const authorBooks = await Book.find({ author: root._id })

          return authorBooks.length
      }
  },
  Mutation: {
      addBook: async (root, args, {currentUser}) => {

        if(!currentUser) {
            throw new AuthenticationError('Not authorized')
        }
        const authorInDb = await Author.findOne({ name: args.author })
        if ( authorInDb ) {
            const book = new Book({...args, author: authorInDb })
            
            try {
                await book.save()

            }catch (error) {
                throw new UserInputError( error.message, {
                    invalidArgs: args,
                })
            }

            return book
        } else {
            const author = new Author({ name: args.author })
            await author.save()

            const book = new Book({...args, author: author })

            try {
                await book.save()

            }catch (error) {
                throw new UserInputError( error.message, {
                    invalidArgs: args,
                })
            }

            return book
        }
      },
      editAuthor: async (root, args, {currentUser}) => {

        if(!currentUser) {
            throw new AuthenticationError('Not authorized')
        }

          const author = await Author.findOne({ name: args.name })

          if(author) {

            const updatedAuthor = await Author.findOneAndUpdate(
                { name: author.name }, 
                { born: args.setBornTo }
            )

            //authors = authors.map(a => a.name !== args.name ? a : updatedAuthor)
            return Author.findOne({ name: updatedAuthor.name })
          }
          return null
      },
      createUser: async (root, args, {currentUser}) => {
        
        if (!currentUser) {
            throw new AuthenticationError('not authorized')
        }

        const user = new User({ ...args })

        try {
            await user.save()
        } catch (error) {
            throw new UserInputError(error.message, {
                invalidArgs: args,
            })
        }

        return user
      },
      login: async (root, args) => {
        const user = await User.findOne({ username: args.username })

        if(!user || args.password !== 'mypass') {
            throw new UserInputError('wrong username or password')
        }

        console.log(user)

        const userForToken = {
            username: user.username,
            id: user._id,
        }

        return { value: jwt.sign(userForToken, JWT_SECRET) }
      },

      deleteBooks: () => Book.deleteMany({}),
      deleteAuthors: () => Author.deleteMany({})
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
      const auth = req ? req.headers.authorization : null

      if (auth && auth.toLowerCase().startsWith('bearer ')) {
          const decodedToken = jwt.verify(
              auth.substring(7), JWT_SECRET
          )

          const currentUser = await User.findById(decodedToken.id)
          return { currentUser }
      }
  }
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})